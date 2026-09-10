classdef ReduceMeanLayer1001 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net_epoch_11.coder.ReduceMeanLayer1001';
        end
    end


    methods
        function this = ReduceMeanLayer1001(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_0_17'};
        end

        function [x_blocks_blocks_0_17] = predict(this, x_blocks_blocks_0_12)
            if isdlarray(x_blocks_blocks_0_12)
                x_blocks_blocks_0_12 = stripdims(x_blocks_blocks_0_12);
            end
            x_blocks_blocks_0_12NumDims = 4;
            x_blocks_blocks_0_12 = severity_net_epoch_11.ops.permuteInputVar(x_blocks_blocks_0_12, [4 3 1 2], 4);

            [x_blocks_blocks_0_17, x_blocks_blocks_0_17NumDims] = ReduceMeanGraph1003(this, x_blocks_blocks_0_12, x_blocks_blocks_0_12NumDims, false);
            x_blocks_blocks_0_17 = severity_net_epoch_11.ops.permuteOutputVar(x_blocks_blocks_0_17, [3 4 2 1], 4);

            x_blocks_blocks_0_17 = dlarray(single(x_blocks_blocks_0_17), 'SSCB');
        end

        function [x_blocks_blocks_0_17] = forward(this, x_blocks_blocks_0_12)
            if isdlarray(x_blocks_blocks_0_12)
                x_blocks_blocks_0_12 = stripdims(x_blocks_blocks_0_12);
            end
            x_blocks_blocks_0_12NumDims = 4;
            x_blocks_blocks_0_12 = severity_net_epoch_11.ops.permuteInputVar(x_blocks_blocks_0_12, [4 3 1 2], 4);

            [x_blocks_blocks_0_17, x_blocks_blocks_0_17NumDims] = ReduceMeanGraph1003(this, x_blocks_blocks_0_12, x_blocks_blocks_0_12NumDims, true);
            x_blocks_blocks_0_17 = severity_net_epoch_11.ops.permuteOutputVar(x_blocks_blocks_0_17, [3 4 2 1], 4);

            x_blocks_blocks_0_17 = dlarray(single(x_blocks_blocks_0_17), 'SSCB');
        end

        function [x_blocks_blocks_0_17, x_blocks_blocks_0_17NumDims1005] = ReduceMeanGraph1003(this, x_blocks_blocks_0_12, x_blocks_blocks_0_12NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_11.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1004, x_blocks_blocks_0_12NumDims);
            xMean = mean(x_blocks_blocks_0_12, dims);
            x_blocks_blocks_0_17 = xMean;
            x_blocks_blocks_0_17NumDims = x_blocks_blocks_0_12NumDims;

            % Set graph output arguments
            x_blocks_blocks_0_17NumDims1005 = x_blocks_blocks_0_17NumDims;

        end

    end

end