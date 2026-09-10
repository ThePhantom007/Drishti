classdef ReduceMeanLayer1014 < nnet.layer.Layer & nnet.layer.Formattable
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
            name = 'severity_net_epoch_10.coder.ReduceMeanLayer1014';
        end
    end


    methods
        function this = ReduceMeanLayer1014(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_4_23'};
        end

        function [x_blocks_blocks_4_23] = predict(this, x_blocks_blocks_4_17)
            if isdlarray(x_blocks_blocks_4_17)
                x_blocks_blocks_4_17 = stripdims(x_blocks_blocks_4_17);
            end
            x_blocks_blocks_4_17NumDims = 4;
            x_blocks_blocks_4_17 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_4_17, [4 3 1 2], 4);

            [x_blocks_blocks_4_23, x_blocks_blocks_4_23NumDims] = ReduceMeanGraph1042(this, x_blocks_blocks_4_17, x_blocks_blocks_4_17NumDims, false);
            x_blocks_blocks_4_23 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_4_23, [3 4 2 1], 4);

            x_blocks_blocks_4_23 = dlarray(single(x_blocks_blocks_4_23), 'SSCB');
        end

        function [x_blocks_blocks_4_23] = forward(this, x_blocks_blocks_4_17)
            if isdlarray(x_blocks_blocks_4_17)
                x_blocks_blocks_4_17 = stripdims(x_blocks_blocks_4_17);
            end
            x_blocks_blocks_4_17NumDims = 4;
            x_blocks_blocks_4_17 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_4_17, [4 3 1 2], 4);

            [x_blocks_blocks_4_23, x_blocks_blocks_4_23NumDims] = ReduceMeanGraph1042(this, x_blocks_blocks_4_17, x_blocks_blocks_4_17NumDims, true);
            x_blocks_blocks_4_23 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_4_23, [3 4 2 1], 4);

            x_blocks_blocks_4_23 = dlarray(single(x_blocks_blocks_4_23), 'SSCB');
        end

        function [x_blocks_blocks_4_23, x_blocks_blocks_4_23NumDims1044] = ReduceMeanGraph1042(this, x_blocks_blocks_4_17, x_blocks_blocks_4_17NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_10.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1043, x_blocks_blocks_4_17NumDims);
            xMean = mean(x_blocks_blocks_4_17, dims);
            x_blocks_blocks_4_23 = xMean;
            x_blocks_blocks_4_23NumDims = x_blocks_blocks_4_17NumDims;

            % Set graph output arguments
            x_blocks_blocks_4_23NumDims1044 = x_blocks_blocks_4_23NumDims;

        end

    end

end